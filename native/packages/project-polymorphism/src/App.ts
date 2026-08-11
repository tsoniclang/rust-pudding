import type { int32 } from "@tsonic/core/types.js";

let constructionOrder = "";

function mark(value: string): string {
  constructionOrder += value;
  return value;
}

interface Named {
  name: string;
  describe(): string;
}

interface Tagged extends Named {
  tag: string;
}

interface Counted extends Named {
  count: int32;
}

interface Complete extends Tagged, Counted {}

class Base {
  name: string = mark("base-field;");

  constructor() {
    this.name = mark("base-body;");
  }

  describe(): string {
    return `base:${this.name}`;
  }
}

class Middle extends Base {
  tag: string = mark("middle-field;");

  constructor() {
    super();
    this.tag = mark("middle-body;");
  }

  describe(): string {
    return `middle>${super.describe()}`;
  }
}

class Leaf extends Middle implements Complete {
  count: int32;

  constructor(count: int32) {
    super();
    this.count = count;
  }

  describe(): string {
    return `leaf>${super.describe()}`;
  }
}

class GenericBase<T> {
  value: T;
  count: int32;

  constructor(value: T, count: int32 = 1) {
    this.value = value;
    this.count = count;
  }
}

class StringValue extends GenericBase<string> {
  label: string = "derived";
}

class __TsonicDispatch_Leaf {
  marker: int32 = 1;
}

class __TsonicRoot_Leaf {
  marker: int32 = 2;
}

export function main(): void {
  const leaf = new Leaf(3);
  const base: Base = leaf;
  const complete: Complete = leaf;
  const named: Named = complete;
  if (base !== leaf || complete !== leaf || named !== leaf) {
    throw new Error("project object identity was not preserved");
  }
  if (base.describe() !== "leaf>middle>base:base-body;" || complete.tag !== "middle-body;" || complete.count !== 3) {
    throw new Error("project inheritance or virtual dispatch failed");
  }
  if (constructionOrder !== "base-field;base-body;middle-field;middle-body;") {
    throw new Error("project construction order failed");
  }

  const first = new StringValue("one");
  const second = new StringValue("two", 2);
  if (first.value !== "one" || first.count !== 1 || first.label !== "derived") {
    throw new Error("implicit inherited constructor failed");
  }
  if (second.value !== "two" || second.count !== 2) {
    throw new Error("inherited generic constructor instantiation failed");
  }

  if (new __TsonicDispatch_Leaf().marker !== 1 || new __TsonicRoot_Leaf().marker !== 2) {
    throw new Error("generated project names collided with authored declarations");
  }
}
