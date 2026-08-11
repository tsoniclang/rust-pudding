import type { int32 } from "@tsonic/core/types.js";

export class TodoItem {
  id: int32;
  title: string;
  completed: boolean;

  constructor(id: int32, title: string) {
    this.id = id;
    this.title = title;
    this.completed = false;
  }

  toggle(): void {
    this.completed = !this.completed;
  }

  isComplete(): boolean {
    return this.completed;
  }
}
