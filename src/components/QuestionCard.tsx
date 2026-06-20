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
  const createdAtDate =
    typeof question.createdAt === "string" ? new Date(question.createdAt) : question.createdAt;
  const avatarUrl =
    question.author.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${question.author.name || "Anonymous"}`;
  const isResolved = question.isResolved;

  return (
    <article className="flex gap-4 p-4 rounded-md border border-border bg-white hover:border-border/80 transition-colors">
      <div className="flex-shrink-0">
        <VoteCounter initialVotes={question.votes} authorId={question.author.id} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {isResolved && (
            <span className="inline-flex items-center gap-1 shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle className="w-3 h-3" />
              Resolved
            </span>
          )}
          <Link to={`/question/${question.id}`} className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug">
              {question.title}
            </h3>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {question.description}
        </p>

        <div className="flex flex-wrap gap-1 mb-3">
          {question.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src={avatarUrl}
              alt={question.author.name || "Anonymous"}
              className="w-5 h-5 rounded-full border border-border"
            />
            <span className="font-medium text-foreground/80">{question.author.name || "Anonymous"}</span>
            <span>·</span>
            <span>{format(createdAtDate, "MMM d, yyyy")}</span>
          </div>

          <div className="flex items-center gap-3">
            {question.hasVerifiedAnswer && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Verified</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {question.answerCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default QuestionCard;
