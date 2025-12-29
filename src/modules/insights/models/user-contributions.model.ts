import { Field, ObjectType, Int } from "@nestjs/graphql";

// Define the contributions object type
@ObjectType()
class Contributions {
      @Field(() => Int, { description: "Total commit contributions" })
      totalCommitContributions: number;

      @Field(() => Int, { description: "Total pull request contributions" })
      totalPullRequestContributions: number;

      @Field(() => Int, { description: "Total contributions" })
      total: number;
}

// Define the weekly contributions object type
@ObjectType()
export class WeeklyContribution {
      @Field(() => String, { description: "Start date of the week" })
      startDate: string;

      @Field(() => Int, { description: "Contribution count for the week" })
      contributionCount: number;
}

// Main user contributions type (for total contributions)
@ObjectType({ description: "Get list of users of an organization with their contributions" })
export class UserContributions {
      @Field(() => String, { description: "User name" })
      userName: string;

      @Field(() => String, { nullable: true, description: "Full name of the user" })
      fullName: string;

      @Field(() => String, { nullable: true, description: "Avatar URL of the user" })
      avatarUrl: string;

      @Field(() => Contributions, { description: "User contributions summary" })
      contributions: Contributions;

      @Field(() => [WeeklyContribution], { description: "Weekly contributions", nullable: true })
      weeklyContributions?: WeeklyContribution[];
}

// Separate type for weekly user contributions (simpler structure)
@ObjectType({ description: "User with weekly contribution data" })
export class UserWeeklyContributions {
      @Field(() => String, { description: "User name" })
      userName: string;

      @Field(() => [WeeklyContribution], { description: "Weekly contributions" })
      weeklyContributions: WeeklyContribution[];
}