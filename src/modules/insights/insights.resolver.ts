import { InsightsService } from "./insights.service";
import { Args, Int, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { Insights } from "./models/insights.model";
import { UserContributions, UserWeeklyContributions } from "./models/user-contributions.model";
import { OrgCommits } from "./models/org-commits.model";

// Note: Resolver provide the instruction to GraphQL on how to fetch the data for a query or mutation

@Resolver(() => Insights)
export class InsightsResolver {
      constructor(
            private readonly insightsService: InsightsService
      ) { }

      @Query(() => Insights, { description: "Get insights for the organization" })
      async getInsights(
            @Args('year', { type: () => Int, nullable: true }) year?: number,
            @Args('startDate', { type: () => String, nullable: true }) startDate?: string,
            @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
      ) {
            return {
                  organizationName: this.insightsService.organizationName,
                  year,
                  startDate,
                  endDate
            };
      }

      @ResolveField(() => [OrgCommits], { description: "Organization Name" })
      orgCommits(@Parent() insights: Insights) {
            return this.insightsService.getOrgTotalCommits();
      }

      @ResolveField(() => [UserContributions], { description: "User Contributions" })
      userContributions(@Parent() insights: Insights) {
            const year = insights.year;
            return this.insightsService.getOrgUserContributions(year);
      }

      @ResolveField(() => [UserWeeklyContributions], { description: "Weekly User Contributions" })
      weeklyUserContributions(@Parent() insights: Insights) {
            const year = insights.year;
            const startDate = insights.startDate;
            const endDate = insights.endDate;
            return this.insightsService.getOrgUserWeeklyContributions(year, startDate, endDate);
      }
}