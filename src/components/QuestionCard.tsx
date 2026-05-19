import { Link } from "react-router-dom";
import { MessageCircle, CheckCircle } from "lucide-react";
import VoteCounter from "./VoteCounter";
import TagPill from "./TagPill";
import { format } from "date-fns";

interface QuestionAuthor {
  id?: string;
  name: string;
  avatar?: string;
  reputation?: number;
}

interface QuestionCardProps {
  question: {
    id: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    author: QuestionAuthor;
    votes: number;
    answerCount: number;
    createdAt: string | Date;
    hasVerifiedAnswer?: boolean;
    isResolved?: boolean;
  };
}

const QuestionCard = ({ question }: QuestionCardProps) => {
  const createdAtDate = typeof question.createdAt === 'string' 
    ? new Date(question.createdAt) 
    : question.createdAt;
  
  const avatarUrl = question.author.avatar || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${question.author.name || 'Anonymous'}`;

  const isResolved = question.isResolved;

  return (
    <article className={`flex gap-4 p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow animate-fade-in ${
      isResolved 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
        : 'bg-card border-border'
    }`}>
      <div className="flex-shrink-0">
        <VoteCounter 
          initialVotes={question.votes} 
          authorId={question.author.id}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <Link to={`/question/${question.id}`}>
          <h3 className="text-base font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 mb-1">
            {isResolved && (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 mr-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Resolved</span>
              </span>
            )}
            {question.title}
          </h3>
        </Link>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {question.description}
        </p>
        
        <div className="flex flex-wrap gap-1.5 mb-3">
          {question.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <img
                src={avatarUrl}
                alt={question.author.name || "Anonymous"}
                className="w-5 h-5 rounded-full"
              />
              <span className="font-medium">{question.author.name || "Anonymous"}</span>
            </div>
            <span>·</span>
            <span>{format(createdAtDate, 'MMM d, yyyy')}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {question.hasVerifiedAnswer && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Verified</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {question.answerCount} answers
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default QuestionCard;
