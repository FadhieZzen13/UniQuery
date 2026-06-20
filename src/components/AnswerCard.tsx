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
  const createdAtDate =
    typeof answer.createdAt === "string" ? new Date(answer.createdAt) : answer.createdAt;
  const avatarUrl =
    answer.author.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${answer.author.name || "Anonymous"}`;

  return (
    <article
      className={cn(
        "flex gap-4 p-4 rounded-md border bg-white",
        answer.isVerified ? "border-emerald-200" : "border-border"
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
          <span className="inline-flex items-center gap-1 mb-2 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle className="h-3 w-3" />
            Accepted Answer
          </span>
        )}

        <div className="prose prose-sm max-w-none text-foreground">
          <p>{answer.content}</p>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src={avatarUrl}
              alt={answer.author.name || "Anonymous"}
              className="w-5 h-5 rounded-full border border-border"
            />
            <span className="font-medium text-foreground/80">{answer.author.name || "Anonymous"}</span>
            <span>·</span>
            <span>{answer.author.reputation ?? 0} pts</span>
          </div>
          <span className="ml-auto flex items-center gap-2">
            {isQuestionAuthor && !answer.isVerified && (
              <Button
                size="sm"
                variant="outline"
                onClick={onVerify}
                className="h-7 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Accept
              </Button>
            )}
            {format(createdAtDate, "MMM d, yyyy")}
          </span>
        </div>
      </div>
    </article>
  );
};

export default AnswerCard;
