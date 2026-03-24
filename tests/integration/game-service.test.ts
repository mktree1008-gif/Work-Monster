import { beforeEach, describe, expect, test } from "vitest";
import { getGameRepository, resetInMemoryRepositoryForTests } from "@/lib/repositories/game-repository";
import {
  acknowledgeRuleVersion,
  approveSubmission,
  recalculateScore,
  submitDailyCheckIn,
  updateRules
} from "@/lib/services/game-service";

describe("game service integration", () => {
  beforeEach(() => {
    resetInMemoryRepositoryForTests();
  });

  test("check-in -> pending -> manager approval -> score updates", async () => {
    const repo = getGameRepository();
    const user = await repo.signIn("user-a@workmonster.app", "user", "en");
    const manager = await repo.signIn("manager-a@workmonster.app", "manager", "en");

    const submission = await submitDailyCheckIn(user.id, {
      mood: "Focused",
      feeling: "Great",
      calories: 520,
      productive: true,
      custom_answers: { focus: "Write docs", blocker: "", win: "Shipped feature" },
      task_list: ["Task 1", "Task 2"],
      file_url: ""
    });

    expect(submission.status).toBe("pending");

    const pending = await repo.listPendingSubmissions();
    expect(pending.length).toBe(1);

    await approveSubmission(
      {
        submissionId: submission.id,
        approved: true,
        note: "Nice output",
        points: 10
      },
      manager.id
    );

    const score = await repo.getScore(user.id);
    expect(score.total_points).toBeGreaterThanOrEqual(10);
    expect(score.current_streak).toBe(1);
  });

  test("rule update bumps version and user can acknowledge", async () => {
    const repo = getGameRepository();
    const manager = await repo.signIn("manager-b@workmonster.app", "manager", "en");
    const user = await repo.signIn("user-b@workmonster.app", "user", "en");

    const beforeRules = await repo.getRules();

    const updated = await updateRules(
      {
        submission_points: beforeRules.submission_points + 2,
        note: "Boost submission reward"
      },
      manager.id
    );

    expect(updated.rule_version).toBe(beforeRules.rule_version + 1);

    const beforeSeen = await repo.getUser(user.id);
    expect(beforeSeen?.last_seen_rule_version).toBeLessThan(updated.rule_version);

    await acknowledgeRuleVersion(user.id);
    const afterSeen = await repo.getUser(user.id);
    expect(afterSeen?.last_seen_rule_version).toBe(updated.rule_version);
  });

  test("negative balance flow shows penalty and supports recovery", async () => {
    const repo = getGameRepository();
    const user = await repo.signIn("user-c@workmonster.app", "user", "en");

    const initial = await repo.getScore(user.id);
    await repo.saveScore({
      ...initial,
      total_points: -2
    });

    const penalized = await recalculateScore(user.id);
    expect(penalized.penalty_active).toBe(true);
    expect(penalized.negative_balance).toBe(2);

    await repo.saveScore({
      ...penalized,
      total_points: 2
    });

    const recovered = await recalculateScore(user.id);
    expect(recovered.penalty_active).toBe(false);
    expect(recovered.negative_balance).toBe(0);
  });
});
