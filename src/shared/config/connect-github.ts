import { Injectable, OnModuleInit } from "@nestjs/common";

type GraphQLClient = typeof import("@octokit/graphql").graphql;

// NOTE: i'm really sick of this issue, it was taking me many hours just to build in the vercel , currently this version of octokit/graphql is a whole esm module, so i want to downgrade it to a cjs module, so i use dynamic import to import the module and use the graphql function from it

@Injectable()
export class ConnectGitHub implements OnModuleInit {
      private client!: GraphQLClient;
      private githubToken = process.env.GITHUB_PAT_TOKEN;

      async onModuleInit() {
            if (!this.githubToken) {
                  throw new Error("GITHUB_PAT_TOKEN is not defined in environment variables.");
            }
            const { graphql } = await import("@octokit/graphql");
            this.client = graphql.defaults({
                  headers: {
                        authorization: `token ${this.githubToken}`,
                  },
            });
      }

      getClient() {
            return this.client;
      }
}

