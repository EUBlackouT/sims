export type Vec2 = {
  x: number;
  y: number;
};

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const vec2Clone = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

export const vec2Distance = (a: Vec2, b: Vec2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const vec2Normalize = (v: Vec2): Vec2 => {
  const length = Math.hypot(v.x, v.y);
  if (length <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / length, y: v.y / length };
};
