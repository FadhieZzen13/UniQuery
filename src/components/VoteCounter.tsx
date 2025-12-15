import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoteCounterProps {
  initialVotes: number;
  size?: "sm" | "md";
}

const VoteCounter = ({ initialVotes, size = "md" }: VoteCounterProps) => {
  const [votes, setVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);

  const handleUpvote = () => {
    if (userVote === "up") {
      setVotes(votes - 1);
      setUserVote(null);
    } else if (userVote === "down") {
      setVotes(votes + 2);
      setUserVote("up");
    } else {
      setVotes(votes + 1);
      setUserVote("up");
    }
  };

  const handleDownvote = () => {
    if (userVote === "down") {
      setVotes(votes + 1);
      setUserVote(null);
    } else if (userVote === "up") {
      setVotes(votes - 2);
      setUserVote("down");
    } else {
      setVotes(votes - 1);
      setUserVote("down");
    }
  };

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-sm" : "text-base";
  const padding = size === "sm" ? "p-0.5" : "p-1";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={handleUpvote}
        className={cn(
          "rounded-md transition-colors hover:bg-success/10",
          padding,
          userVote === "up" && "text-success bg-success/10"
        )}
        aria-label="Upvote"
      >
        <ChevronUp className={iconSize} />
      </button>
      <span className={cn("font-semibold text-foreground", textSize)}>
        {votes}
      </span>
      <button
        onClick={handleDownvote}
        className={cn(
          "rounded-md transition-colors hover:bg-destructive/10",
          padding,
          userVote === "down" && "text-destructive bg-destructive/10"
        )}
        aria-label="Downvote"
      >
        <ChevronDown className={iconSize} />
      </button>
    </div>
  );
};

export default VoteCounter;
