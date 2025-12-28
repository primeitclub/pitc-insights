import { ConnectGitHub } from "src/shared/config/connect-github";
import { Injectable } from "@nestjs/common";
import { ConnectRedis } from "src/shared/config/connect-redis";
import { getLastWeekFromStartDate } from "src/shared/utils/utils";

// Note: Its better use a graphql variable when wrtiting queries to avoid injection attacks
//  Note: You can make 5000 requests per hour with authentication, unauthenticated requests get 60 requests per hour

interface RepoCommitsResponse {
      repository: {
            ref: {
                  target: {
                        history: {
                              totalCount: number;
                        };
                  };
            } | null;
      };
}

@Injectable()
export class InsightsService {
      organizationName: string = process.env.GITHUB_ORG_NAME || "";
      private repoNumber: number = process.env.GITHUB_REPO_NUMBER
            ? parseInt(process.env.GITHUB_REPO_NUMBER)
            : 100;
      private userNumber: number = process.env.GITHUB_USER_NUMBER
            ? parseInt(process.env.GITHUB_USER_NUMBER)
            : 50;
      // Smaller batch size for queries with contributionsCollection to avoid GitHub's resource limits
      private contributionsBatchSize: number = 10;
      private ORG_COMMITS_PREFIX = 'orgTotalCommits_';
      private ORG_USER_CONTRIBUTIONS_PREFIX = 'orgUserContributions_';
      private ORG_USER_WEEKLY_PREFIX = 'orgUserWeeklyContributions_';
      private SESSION_TTL_SECONDS = 3600; // 1 hour
      constructor(private readonly connectGitHub: ConnectGitHub, private readonly connectRedis: ConnectRedis) { }



      async getOrgTotalCommits(): Promise<{ repoName: string; totalYears: number[]; commits: number }[]> {
            try {
                  const cachedData = await this.connectRedis.get<{ repoName: string; totalYears: number[]; commits: number }[]>(this.ORG_COMMITS_PREFIX + this.organizationName);
                  if (cachedData) {
                        console.log("Returning cached organization total commits");
                        return cachedData;
                  }
                  const repos = await this.connectGitHub.getClient()<{
                        organization: {
                              createdAt: string;
                              repositories: {
                                    pageInfo: { hasNextPage: boolean; endCursor: string };
                                    nodes: { name: string; defaultBranchRef: { target: { history: { totalCount: number } } } | null }[];
                              };
                        };
                  }>(
                        `query GetOrgReposWithCommits($organizationName: String!, $num: Int!, $cursor: String) {
                        organization(login: $organizationName) {
                              createdAt
                              repositories(first: $num, after: $cursor) {
                                    pageInfo {
                                          hasNextPage
                                          endCursor
                                    }
                                    nodes {
                                          name
                                          defaultBranchRef {
                                                target {
                                                      ... on Commit {
                                                            history {
                                                                  totalCount
                                                            }
                                                      }
                                                }
                                          }
                                    }
                              }
                        }
                  }`,
                        {
                              organizationName: this.organizationName,
                              cursor: null,
                              num: this.repoNumber,
                        },
                  );
                  const foundingYear = new Date(repos.organization.createdAt).getFullYear();
                  const currentYear = new Date().getFullYear();

                  // Generate array of all years
                  const totalYears: number[] = [];
                  for (let year = foundingYear; year <= currentYear; year++) {
                        totalYears.push(year);
                  }
                  const orgCommits = repos.organization.repositories.nodes.map((repo) => ({
                        repoName: repo.name,
                        totalYears: totalYears,
                        commits: repo?.defaultBranchRef?.target.history.totalCount ?? 0,
                  }));
                  await this.connectRedis.set(this.ORG_COMMITS_PREFIX + this.organizationName, orgCommits, this.SESSION_TTL_SECONDS);
                  return orgCommits;
            }
            catch (error) {
                  console.error("Error fetching organization total commits:", error);
                  throw new Error("Failed to fetch organization total commits.");
            }
      }

      async getOrgUserContributions(year?: number): Promise<{
            userName: string;
            fullName: string;
            avatarUrl: string;
            contributions: {
                  totalCommitContributions: number;
                  totalPullRequestContributions: number;
                  total: number;
            }
      }[]> {
            try {
                  const targetYear = year || new Date().getFullYear();
                  //    2024-12-31T24:00:00Z refers to the exact same moment in time as 2025-01-01T00:00:00Z. Most database and programming languages (like Python, Java, and JavaScript) enforce a strict 0–23 hour range to avoid this redundancy and simplify logic.
                  const fromDate = new Date(`${targetYear}-01-01T00:00:00Z`).toISOString();
                  const toDate = new Date(`${targetYear}-12-31T23:59:59Z`).toISOString();

                  const cacheKey = `${this.ORG_USER_CONTRIBUTIONS_PREFIX}${this.organizationName}:${targetYear}`;

                  const cachedData = await this.connectRedis.get<any>(cacheKey);
                  if (cachedData) {
                        console.log("Returning cached organization user contributions");
                        return cachedData;
                  }
                  let hasNextPage = true;
                  let afterCursor: string | null = null;
                  const allMembers = []
                  while (hasNextPage) {
                        const result: {
                              organization: {
                                    membersWithRole: {
                                          pageInfo: { hasNextPage: boolean; endCursor: string };
                                          nodes: {
                                                login: string;
                                                name: string;
                                                avatarUrl: string;
                                                contributionsCollection: {
                                                      totalCommitContributions: number;
                                                      totalPullRequestContributions: number;
                                                };
                                          }[];
                                    };
                              };
                        } = await this.connectGitHub.getClient()(
                              `query GetOrgMembers($organizationName: String!, $num: Int!,$after: String, $from: DateTime!, $to: DateTime!) {
                organization(login: $organizationName) {
                    membersWithRole(first: $num, after: $after) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            login
                            name  
                            avatarUrl
                            contributionsCollection(from: $from, to: $to) {
                                totalCommitContributions
                                totalPullRequestContributions
                            }
                        }
                    }
                }
            }`,
                              {
                                    organizationName: this.organizationName,
                                    num: this.contributionsBatchSize,
                                    after: afterCursor,
                                    from: fromDate,
                                    to: toDate,
                              },
                        );
                        // first: means the number of items to return per page starting from the beginning of the list
                        // endCursor: means the cursor to the next page
                        const { pageInfo, nodes } = result.organization.membersWithRole;
                        allMembers.push(...nodes);
                        hasNextPage = pageInfo.hasNextPage && allMembers.length < this.userNumber;
                        afterCursor = pageInfo.endCursor;
                  }

                  const userContributions = allMembers.map((node) => ({
                        userName: node.login,
                        fullName: node.name,
                        avatarUrl: node.avatarUrl,
                        contributions: {
                              totalCommitContributions: node.contributionsCollection.totalCommitContributions,
                              totalPullRequestContributions: node.contributionsCollection.totalPullRequestContributions,
                              total: node.contributionsCollection.totalCommitContributions +
                                    node.contributionsCollection.totalPullRequestContributions,
                        },
                  }))
                        .sort((a, b) => b.contributions.total - a.contributions.total);

                  await this.connectRedis.set(cacheKey, userContributions, this.SESSION_TTL_SECONDS);
                  return userContributions;
            }
            catch (error) {
                  console.error("Error fetching organization user contributions:", error);
                  throw new Error("Failed to fetch organization user contributions.");
            }
      }


      async getOrgUserWeeklyContributions(year?: number, startDate?: string, endDate?: string): Promise<{
            userName: string;
            weeklyContributions: Array<{
                  startDate: string;
                  contributionCount: number;
            }>;
      }[]> {
            try {

                  const targetYear = year || new Date().getFullYear();
                  const startDateStr = startDate || `${targetYear}-01-01`;
                  const endDateStr = endDate || getLastWeekFromStartDate(startDateStr);
                  console.log("START DATE", startDateStr);
                  console.log("END DATE", endDateStr);
                  // Fetch full year for caching efficiency
                  const fromDate = new Date(`${targetYear}-01-01T00:00:00Z`).toISOString();
                  const toDate = new Date(`${targetYear}-12-31T23:59:59Z`).toISOString();

                  const cacheKey = `${this.ORG_USER_WEEKLY_PREFIX}${this.organizationName}:${targetYear}:${startDateStr}:${endDateStr}`;

                  const cachedData = await this.connectRedis.get<any>(cacheKey);

                  let fullYearWeeklyData;
                  let hasNextPage = true;
                  let afterCursor: string | null = null;
                  const allMembers = []

                  if (cachedData) {
                        console.log("Returning cached weekly contributions");
                        fullYearWeeklyData = cachedData;
                  } else {
                        while (hasNextPage) {
                              const result: {
                                    organization: {
                                          membersWithRole: {
                                                pageInfo: { hasNextPage: boolean; endCursor: string };
                                                nodes: {
                                                      login: string;
                                                      contributionsCollection: {
                                                            contributionCalendar: {
                                                                  weeks: {
                                                                        contributionDays: {
                                                                              date: string;
                                                                              contributionCount: number;
                                                                        }[];
                                                                  }[];
                                                            };
                                                      };
                                                }[];
                                          };
                                    };
                              } = await this.connectGitHub.getClient()(
                                    `query GetOrgMembersWeekly($organizationName: String!, $num: Int!, $after: String, $from: DateTime!, $to: DateTime!) {
                    organization(login: $organizationName) {
                        membersWithRole(first: $num, after: $after) {
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            nodes {
                                login
                                contributionsCollection(from: $from, to: $to) {
                                    contributionCalendar {
                                        weeks {
                                            contributionDays {
                                                date
                                                contributionCount
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }`,
                                    {
                                          organizationName: this.organizationName,
                                          num: this.contributionsBatchSize,
                                          after: afterCursor,
                                          from: fromDate,
                                          to: toDate,
                                    },
                              );
                              const { pageInfo, nodes } = result.organization.membersWithRole;
                              allMembers.push(...nodes);
                              hasNextPage = pageInfo.hasNextPage && allMembers.length < this.userNumber;
                              afterCursor = pageInfo.endCursor;
                        }
                        fullYearWeeklyData = allMembers.map((node) => ({
                              userName: node.login,
                              weeks: node.contributionsCollection.contributionCalendar.weeks.map((week) => {
                                    const totalWeekContributions = week.contributionDays.reduce(
                                          (sum, day) => sum + day.contributionCount,
                                          0
                                    );
                                    const startDate = week.contributionDays[0]?.date || '';
                                    return {
                                          startDate,
                                          contributionCount: totalWeekContributions
                                    };
                              }).filter(week => week.startDate)
                        }));
                        await this.connectRedis.set(cacheKey, fullYearWeeklyData, this.SESSION_TTL_SECONDS);
                  }
                  const filteredData = fullYearWeeklyData.map((user: any) => ({
                        userName: user.userName,
                        weeklyContributions: user.weeks.filter((week: any) =>
                              week.startDate >= startDateStr && week.startDate <= endDateStr
                        )
                  }));

                  return filteredData;
            } catch (error) {
                  console.error("Error fetching organization weekly contributions:", error);
                  throw new Error("Failed to fetch organization weekly contributions.");
            }
      }
      async getInsights() {
            // const [orgCommits, userContributions] = await Promise.all([
            //       this.getOrgTotalCommits(),
            //       this.getOrgUserContributions(),
            // ]);

            return {
                  organizationName: this.organizationName,
                  // orgCommits,
                  // userContributions,
            };
      }
}