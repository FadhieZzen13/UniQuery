import { CheckCircle } from "lucide-react";
import { Answer } from "@/types";
import VoteCounter from "./VoteCounter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AnswerCardProps {
  answer: Answer;
}

const AnswerCard = ({ answer }: AnswerCardProps) => {
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
        <VoteCounter initialVotes={answer.votes} size="sm" />
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
              src={answer.author.avatar}
              alt={answer.author.name}
              className="w-6 h-6 rounded-full"
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium text-foreground">{answer.author.name}</span>
              <span className="hidden sm:inline">·</span>
              <span className="text-success font-medium">{answer.author.reputation} pts</span>
            </div>
          </div>
          <span className="ml-auto">
            {formatDistanceToNow(answer.createdAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </article>
  );
};

export default AnswerCard;
