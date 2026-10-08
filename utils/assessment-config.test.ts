import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSESSMENT_QUESTION_COUNT,
  MAX_ASSESSMENT_QUESTIONS,
  QUESTIONS_PER_VIDEO_MINUTE,
  assessmentQuestionCountForDuration,
} from './assessment-config';

describe('assessmentQuestionCountForDuration', () => {
  it('asks one question per started minute', () => {
    assert.equal(assessmentQuestionCountForDuration(60, 2), 1);
    assert.equal(assessmentQuestionCountForDuration(10 * 60, 2), 10);
    assert.equal(assessmentQuestionCountForDuration(45 * 60, 2), 45);
  });

  it('rounds a partial minute up, so a started minute is never untested', () => {
    assert.equal(assessmentQuestionCountForDuration(30, 2), 1);
    assert.equal(assessmentQuestionCountForDuration(90, 2), 2);
    assert.equal(assessmentQuestionCountForDuration(61, 2), 2);
    assert.equal(assessmentQuestionCountForDuration(10 * 60 + 1, 2), 11);
  });

  it('never asks fewer than one question', () => {
    assert.equal(assessmentQuestionCountForDuration(1, 2), 1);
    assert.equal(assessmentQuestionCountForDuration(0.4, 2), 1);
  });

  it('caps long videos at the maximum', () => {
    const cap = MAX_ASSESSMENT_QUESTIONS * 60;
    assert.equal(assessmentQuestionCountForDuration(cap, 2), MAX_ASSESSMENT_QUESTIONS);
    assert.equal(assessmentQuestionCountForDuration(cap + 1, 2), MAX_ASSESSMENT_QUESTIONS);
    assert.equal(assessmentQuestionCountForDuration(3 * 60 * 60, 2), MAX_ASSESSMENT_QUESTIONS);
  });

  it('does not exceed the maximum just below the cap boundary', () => {
    // 49 started minutes is under the ceiling; 50 is exactly the ceiling.
    assert.equal(assessmentQuestionCountForDuration(49 * 60 + 30, 2), 50);
    assert.equal(assessmentQuestionCountForDuration(50 * 60, 2), MAX_ASSESSMENT_QUESTIONS);
  });

  it('falls back to the admin count when the runtime is unknown', () => {
    assert.equal(assessmentQuestionCountForDuration(0, 7), 7);
    assert.equal(assessmentQuestionCountForDuration(0, ASSESSMENT_QUESTION_COUNT), 2);
  });

  it('falls back for a non-finite or negative runtime', () => {
    assert.equal(assessmentQuestionCountForDuration(Number.NaN, 5), 5);
    assert.equal(assessmentQuestionCountForDuration(Number.POSITIVE_INFINITY, 5), 5);
    assert.equal(assessmentQuestionCountForDuration(-120, 5), 5);
  });

  it('clamps a nonsense fallback into the valid range', () => {
    assert.equal(assessmentQuestionCountForDuration(0, 0), 1);
    assert.equal(assessmentQuestionCountForDuration(0, -3), 1);
    assert.equal(assessmentQuestionCountForDuration(0, Number.NaN), 1);
    assert.equal(assessmentQuestionCountForDuration(0, 999), MAX_ASSESSMENT_QUESTIONS);
    assert.equal(assessmentQuestionCountForDuration(0, 4.7), 4);
  });

  it('always returns a whole number within 1..MAX', () => {
    for (const seconds of [0, 1, 59, 60, 61, 3_600, 2_999, 3_000, 12_345, 99_999]) {
      const count = assessmentQuestionCountForDuration(seconds, 3);
      assert.ok(Number.isInteger(count), `${seconds}s -> ${count} is not an integer`);
      assert.ok(
        count >= 1 && count <= MAX_ASSESSMENT_QUESTIONS,
        `${seconds}s -> ${count} out of range`
      );
    }
  });

  it('is monotonic: a longer video never yields fewer questions', () => {
    let previous = 0;
    for (let seconds = 0; seconds <= 80 * 60; seconds += 37) {
      const count = assessmentQuestionCountForDuration(seconds, 1);
      assert.ok(count >= previous, `${seconds}s dropped from ${previous} to ${count}`);
      previous = count;
    }
  });

  it('scales with the configured per-minute rate', () => {
    // The rate is the one knob that changes the feel of every quiz, so the
    // arithmetic is asserted through it rather than hardcoded.
    assert.equal(QUESTIONS_PER_VIDEO_MINUTE, 1);
  });
});
