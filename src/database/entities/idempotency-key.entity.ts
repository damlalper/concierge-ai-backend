import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index(['keyHash'], { unique: true })
@Index(['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key_hash', length: 64, unique: true })
  keyHash: string;

  @Column({ name: 'source_system', length: 50 })
  sourceSystem: string;

  @Column({ name: 'request_id', length: 255 })
  requestId: string;

  @Column({ name: 'job_id', length: 255, nullable: true })
  jobId: string;

  @Column({ length: 20, default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
