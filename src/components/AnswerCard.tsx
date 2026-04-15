import { CheckCircle } from "lucide-react";
import VoteCounter from "./VoteCounter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Author {
  id?: string;
  name: string;
  avatar?: string;
  reputation?: number;
}

interface Answer {
  id: string;
  content: string;
  author: Author;
  votes: number;
  isVerified: boolean;
  createdAt: string | Date;
}

interface AnswerCardProps {
  answer: Answer;
  isQuestionAuthor?: boolean;
  onVerify?: () => void;
}

const AnswerCard = ({ answer, isQuestionAuthor, onVerify }: AnswerCardProps) => {
  const createdAtDate = typeof answer.createdAt === 'string' 
    ? new Date(answer.createdAt) 
    : answer.createdAt;
  
  const avatarUrl = answer.author.avatar || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${answer.author.name || 'Anonymous'}`;

  return (
    <article
      className={cn(
        "flex gap-4 p-4 bg-card rounded-lg border shadow-sm animate-fade-in",
        answer.isVerified
          ? "border-success/30 bg-success/5"
          : "border-border"
      )}
    >
      <div className="flex-shrink-0">
        <VoteCounter 
          initialVotes={answer.votes} 
          size="sm" 
          answerId={answer.id}
          authorId={answer.author.id}
        />
      </div>

      <div className="flex-1 min-w-0">
        {answer.isVerified && (
          <div className="flex items-center gap-1.5 text-success text-sm font-medium mb-2">
            <CheckCircle className="h-4 w-4" />
            Verified Answer
          </div>
        )}

        <div className="prose prose-sm max-w-none text-foreground">
          <p>{answer.content}</p>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src={avatarUrl}
              alt={answer.author.name || "Anonymous"}
              className="w-6 h-6 rounded-full"
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium text-foreground">{answer.author.name || "Anonymous"}</span>
              <span className="hidden sm:inline">·</span>
              <span className="text-success font-medium">{answer.author.reputation || 0} pts</span>
            </div>
          </div>
          <span className="ml-auto flex items-center gap-2">
            {isQuestionAuthor && !answer.isVerified && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onVerify}
                className="text-success hover:text-success hover:bg-success/10"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Mark as Answer
              </Button>
            )}
            {format(createdAtDate, 'MMM d, yyyy')}
          </span>
        </div>
      </div>
    </article>
  );
};

export default AnswerCard;
