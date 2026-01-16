/**
 * Canvas type definitions
 */

export interface Canvas {
  _id: string;
  _creationTime: number;
  workosOrgId: string;
  title: string;
  slug: string;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}
