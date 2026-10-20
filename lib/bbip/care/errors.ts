// lib/bbip/care/errors.ts
/** A user-facing failure of the care-order draft (Korean message). */
export class CareGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareGenerationError";
  }
}

export class CareNotFoundError extends Error {
  constructor() {
    super("세션을 찾을 수 없습니다.");
    this.name = "CareNotFoundError";
  }
}
