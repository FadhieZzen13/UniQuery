export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  reputation: number;
  joinedAt: Date;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  author: User;
  votes: number;
  answerCount: number;
  createdAt: Date;
  hasVerifiedAnswer?: boolean;
}

export interface Answer {
  id: string;
  content: string;
  author: User;
  votes: number;
  isVerified: boolean;
  createdAt: Date;
}

export type Category = 'all' | 'academic' | 'administrative' | 'hostel' | 'student-life';

export interface CategoryItem {
  id: Category;
  label: string;
  icon: string;
}
