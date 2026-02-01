import { IsString, IsEmail, IsDateString, IsNumber, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum EventType {
  BOOKING_CREATED = 'booking.created',
  BOOKING_UPDATED = 'booking.updated',
  BOOKING_CANCELLED = 'booking.cancelled',
}

export class GuestDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class WebhookBookingDto {
  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty()
  @IsString()
  bookingId: string;

  @ApiProperty()
  @IsString()
  hotelId: string;

  @ApiProperty({ type: GuestDto })
  @ValidateNested()
  @Type(() => GuestDto)
  guest: GuestDto;

  @ApiProperty()
  @IsDateString()
  checkIn: string;

  @ApiProperty()
  @IsDateString()
  checkOut: string;

  @ApiProperty()
  @IsString()
  roomType: string;

  @ApiProperty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty()
  @IsString()
  currency: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
