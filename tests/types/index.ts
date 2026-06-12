/**
 * Domain interfaces and types
 */

// Authentication
export type UserRole = 'ADMIN' | 'MANAGER' | 'DEVELOPER';

export interface User {
  username: string;
  password: string;
  role: 'manager' | 'developer' | 'admin';
}

export interface UserCredentials {
  identifier: string;
  password: string;
}

export interface AuthLoginRequest {
  identifier: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  type?: string;
  role?: string;
  jobTitle?: string;
  profilePicture?: string | null;
}

export interface AuthLoginResponse {
  token: string;
  user: AuthUser;
  projectId?: number;
  projectName?: string;
}

export interface UserSession {
  id: number;
  name: string;
  role: UserRole;
  jobTitle: string;
  type: string;
  profilePicture?: string | null;
}

export interface ApiErrorResponse {
  message: string;
}

// Project

export interface IdRef {
  id: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
}

export interface ProjectContext {
  projectId: string | null;
  projectName: string;
}

// Tasks
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskClassification = 'FEATURE' | 'BUG' | 'USER_STORY' | 'TASK';
export type KanbanColumn = 'To Do' | 'In Progress' | 'In Review' | 'Done';

export interface Task {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  classification: TaskClassification;
  startDate?: string;
  dueDate?: string;
}

export interface TaskDto {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  classification: TaskClassification;
  assignedHours?: number;
  assignedSprint?: IdRef;
  startDate?: string;
  dueDate?: string;
  finishDate?: string;
  updatedAt?: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  typeLabel: RegExp;
  priorityLabel: RegExp;
  startDate: string;
  dueDate: string;
}

// Developer metrics

export interface DeveloperMetrics {
  tasksAssigned: number;
  tasksCompleted: number;
  productivityScore?: number;
}

// Test helpers

export type TestTag = '@smoke' | '@auth' | '@manager' | '@developer' | '@tasks' | '@mock';

export interface LoginTestCase {
  name: string;
  user: UserCredentials;
  shouldFail: boolean;
}

export interface MockLoginPayload {
  token: string;
  user: AuthUser;
  projectId: number;
  projectName: string;
}
