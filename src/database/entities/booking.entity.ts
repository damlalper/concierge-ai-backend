import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Guest } from './guest.entity';
import { Hotel } from './hotel.entity';
import { RoomType } from './room-type.entity';

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
}

@Entity('bookings')
@Index(['hotelId', 'checkIn', 'checkOut'])
@Index(['guestId'])
@Index(['status'])
@Index(['externalBookingId', 'sourceSystem'], { unique: true })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_booking_id', length: 255 })
  @Index()
  externalBookingId: string;

  @Column({ name: 'source_system', length: 50 })
  sourceSystem: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotel_id' })
  hotel: Hotel;

  @Column({ name: 'guest_id', type: 'uuid' })
  guestId: string;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ name: 'check_in', type: 'timestamptz' })
  checkIn: Date;

  @Column({ name: 'check_out', type: 'timestamptz' })
  checkOut: Date;

  @Column({ name: 'room_type_id', type: 'uuid', nullable: true })
  roomTypeId: string;

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
