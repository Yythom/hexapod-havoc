/** 均匀网格空间索引：每帧重建，用来做怪物互相推开、子弹命中、接触伤害的邻近查询 */
export class SpatialGrid<T extends { x: number; y: number; active: boolean }> {
  private readonly cells: T[][];
  private readonly cols: number;
  private readonly rows: number;

  constructor(width: number, height: number, private readonly cellSize: number) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const c of this.cells) c.length = 0;
  }

  insert(item: T): void {
    this.cells[this.row(item.y) * this.cols + this.col(item.x)].push(item);
  }

  /** 找出 (x,y) 半径 r 范围内所在格子里的对象（粗筛），写入 out 并返回 */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const c0 = this.col(x - r);
    const c1 = this.col(x + r);
    const r0 = this.row(y - r);
    const r1 = this.row(y + r);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        for (const it of this.cells[row * this.cols + col]) {
          if (it.active) out.push(it);
        }
      }
    }
    return out;
  }

  private col(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
  }
}
