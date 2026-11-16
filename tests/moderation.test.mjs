// Путь заявки психолога: draft → new → approved | rejected, и обратно на
// модерацию после отказа. Импортируем настоящие правила из src.
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterEducationSubmit, canApprove, onlyOwnUploads } from "../src/lib/rules.ts";

const UPLOAD = "/uploads/123e4567-e89b-12d3-a456-426614174000.pdf";

test("черновик без документов одобрить нельзя", () => {
  assert.equal(canApprove("draft"), false);
  assert.equal(canApprove("new"), true);
  assert.equal(canApprove("approved"), true);
  assert.equal(canApprove("rejected"), true);
});

test("черновик с документами уходит на модерацию", () => {
  assert.deepEqual(afterEducationSubmit("draft"), { moderationStatus: "new", needsReview: false });
});

test("отклонённая заявка после правок уходит на повторную модерацию", () => {
  assert.deepEqual(afterEducationSubmit("rejected"), { moderationStatus: "new", needsReview: false });
});

test("одобренный профиль остаётся опубликованным, но помечается на вычитку", () => {
  assert.deepEqual(afterEducationSubmit("approved"), { moderationStatus: "approved", needsReview: true });
});

test("заявка на модерации не меняет статус", () => {
  assert.deepEqual(afterEducationSubmit("new"), { moderationStatus: "new", needsReview: false });
});

test("в документы попадают только наши загрузки", () => {
  assert.deepEqual(
    onlyOwnUploads([
      UPLOAD,
      "https://evil.example/diploma.pdf",
      "/uploads/../../etc/passwd",
      "/uploads/not-a-uuid.pdf",
      "",
    ]),
    [UPLOAD],
  );
  assert.deepEqual(onlyOwnUploads(undefined), []);
});
