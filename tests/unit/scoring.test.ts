import { describe, expect, test } from "vitest";
import { computeMultiplier, computeNextReward, computePenaltyState, computeStreak } from "@/lib/logic/scoring";
import { Reward } from "@/lib/types";

describe("scoring helpers", () => {
  test("penalty activation and threshold crossing", () => {
    const active = computePenaltyState(-6, [-1, -5, -10], []);
    expect(active.penalty_active).toBe(true);
    expect(active.negative_balance).toBe(6);
    expect(active.crossed_thresholds).toEqual([-1, -5]);

    const recovered = computePenaltyState(1, [-1, -5, -10], [
      {
        id: "penalty_1",
        user_id: "u1",
        threshold: -1,
        negative_balance: 2,
        description: "Risk Zone",
        reward_label: "Manager reward unlocked",
        reward_value: "$200 equivalent",
        manager_reward_unlocked: true,
        claimed_by_manager: false,
        triggered_at: new Date().toISOString()
      }
    ]);
    expect(recovered.penalty_active).toBe(false);
    expect(recovered.recovered).toBe(true);
  });

  test("streak and multiplier transitions", () => {
    expect(computeStreak(0, undefined, "2026-03-24")).toBe(1);
    expect(computeStreak(1, "2026-03-24", "2026-03-25")).toBe(2);
    expect(computeStreak(5, "2026-03-24", "2026-03-28")).toBe(1);

    expect(computeMultiplier(3, 7, 1.5)).toEqual({
      multiplier_active: false,
      multiplier_value: 1
    });
    expect(computeMultiplier(8, 7, 1.5)).toEqual({
      multiplier_active: true,
      multiplier_value: 1.5
    });
  });

  test("next reward calculations", () => {
    const rewards: Reward[] = [
      {
        id: "r1",
        title: "R1",
        description: "desc",
        required_points: 20,
        created_by: "m",
        created_at: new Date().toISOString()
      },
      {
        id: "r2",
        title: "R2",
        description: "desc",
        required_points: 50,
        created_by: "m",
        created_at: new Date().toISOString()
      }
    ];

    const next = computeNextReward(30, rewards);
    expect(next.reward?.id).toBe("r2");
    expect(next.pointsRemaining).toBe(20);

    const allDone = computeNextReward(60, rewards);
    expect(allDone.reward).toBeNull();
    expect(allDone.progressPercent).toBe(100);
  });
});
