import { Type } from '@nestjs/common';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class PaginationUtil {
  static createPaginationResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginationResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  static validatePagination(page: number, limit: number): {
    page: number;
    limit: number;
  } {
    const validPage = Math.max(1, Math.floor(page) || 1);
    const validLimit = Math.max(1, Math.min(100, Math.floor(limit) || 10));

    return {
      page: validPage,
      limit: validLimit,
    };
  }
}
