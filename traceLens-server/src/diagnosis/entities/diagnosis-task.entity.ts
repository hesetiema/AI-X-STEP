import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('diagnosis_tasks')
export class DiagnosisTaskEntity {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ type: 'enum', enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' })
  status: string;

  // ── 请求元数据 ──
  @Column({ length: 128 })
  appId: string;

  @Column({ type: 'text' })
  pageUrl: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ── 结构化数据（JSON 列）──
  @Column({ type: 'json' })
  evidence: unknown[];

  @Column({ type: 'json', nullable: true })
  symptoms: string[] | null;

  @Column({ type: 'json', nullable: true })
  findings: unknown[] | null;

  @Column({ type: 'json', nullable: true })
  rankedFindings: unknown[] | null;

  @Column({ type: 'json', nullable: true })
  conclusion: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  dominoChain: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  explanation: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  // ── 时间戳 ──
  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
