import { Link } from "react-router-dom";
import { MessageCircle, CheckCircle } from "lucide-react";
import { Question } from "@/types";
import VoteCounter from "./VoteCounter";
import TagPill from "./TagPill";
import { formatDistanceToNow } from "date-fns";

interface QuestionCardProps {
  question: Question;
}

const QuestionCard = ({ question }: QuestionCardProps) => {
  return (
    <article className="flex gap-4 p-4 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex-shrink-0">
        <VoteCounter initialVotes={question.votes} />
      </div>
      
      <div className="flex-1 min-w-0">
        <Link to={`/question/${question.id}`}>
          <h3 className="text-base font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 mb-1">
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
                src={question.author.avatar}
                alt={question.author.name}
                className="w-5 h-5 rounded-full"
              />
              <span className="font-medium">{question.author.name}</span>
            </div>
            <span>·</span>
            <span>{formatDistanceToNow(question.createdAt, { addSuffix: true })}</span>
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
