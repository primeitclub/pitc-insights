import { Field, Int, ObjectType } from "@nestjs/graphql";
import { OrgCommits } from "@modules/insights/models/org-commits.model";
import { UserContributions } from "@modules/insights/models/user-contributions.model";

@ObjectType({ description: "Get Insights of an organization" })

export class Insights {
      @Field(() => String, { description: "Organization name" })
      organizationName: string;

      @Field(() => Int, { nullable: true })
      year?: number;

      @Field({ nullable: true })
      startDate?: string;

      @Field({ nullable: true })
      endDate?: string;
}