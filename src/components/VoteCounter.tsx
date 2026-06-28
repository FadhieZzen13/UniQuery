import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { votesApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface VoteCounterProps {
  initialVotes: number;
  size?: "sm" | "md";
  questionId?: string;
  answerId?: string;
  authorId?: string;
}

type Vote = "up" | "down" | null;

const deltaOf = (vote: Vote) => (vote === "up" ? 1 : vote === "down" ? -1 : 0);

const VoteCounter = ({ initialVotes, size = "md", questionId, answerId, authorId }: VoteCounterProps) => {
  const { user, isAuthenticated } = useAuth();
  // Single source of truth: `baseVotes` is the score WITHOUT the current user's own
  // vote, and `userVote` is that vote. The number we render is always
  // baseVotes + deltaOf(userVote), so switching down -> up can never leave a stale
  // negative on screen the way refetching only the highlight did before.
  const [baseVotes, setBaseVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<Vote>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOwnContent = Boolean(user && authorId && user.id === authorId);
  const displayedVotes = baseVotes + deltaOf(userVote);

  // On mount (and when the target changes), learn the user's existing vote so we can
  // back it out of the incoming total. `initialVotes` includes the user's own vote,
  // so baseVotes = initialVotes - (their vote).
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if ((!questionId && !answerId) || !isAuthenticated) {
        setUserVote(null);
        setBaseVotes(initialVotes);
        return;
      }
      try {
        const status = questionId
          ? await votesApi.getQuestionVoteStatus(questionId)
          : await votesApi.getAnswerVoteStatus(answerId as string);
        if (cancelled) return;
        const value: number = status.value ?? 0;
        setUserVote(value === 1 ? "up" : value === -1 ? "down" : null);
        setBaseVotes(initialVotes - value);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch vote status:", error);
        setUserVote(null);
        setBaseVotes(initialVotes);
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, answerId, isAuthenticated, initialVotes]);

  const handleVote = async (direction: "up" | "down") => {
    if (isLoading) return;

    if (isOwnContent) {
      toast({
        title: "Cannot vote",
        description: "You cannot vote on your own content",
        variant: "destructive",
      });
      return;
    }

    const prevVote = userVote;
    // Clicking the active direction toggles it off; otherwise switch to it.
    const nextVote: Vote = direction === prevVote ? null : direction;

    // Optimistic update — the rendered count follows baseVotes + deltaOf(nextVote).
    setUserVote(nextVote);

    // No target id (e.g. the dashboard feed): purely cosmetic, nothing to persist.
    if ((!questionId && !answerId) || !isAuthenticated) return;

    setIsLoading(true);
    const value = nextVote === "up" ? 1 : -1;
    try {
      if (questionId) {
        // The backend enforces one vote per (voter, target), so changing a vote means
        // removing the existing one first.
        if (prevVote !== null) await votesApi.removeQuestionVote(questionId);
        if (nextVote !== null) await votesApi.voteQuestion(questionId, value);
      } else if (answerId) {
        if (prevVote !== null) await votesApi.removeAnswerVote(answerId);
        if (nextVote !== null) await votesApi.voteAnswer(answerId, value);
      }
    } catch (error) {
      // Roll back to what the server still believes.
      setUserVote(prevVote);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to vote",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-sm" : "text-base";
  const padding = size === "sm" ? "p-0.5" : "p-1";

  return (
    <div className={cn("flex flex-col items-center gap-0.5", isOwnContent && "opacity-50")}>
      <button
        onClick={() => handleVote("up")}
        disabled={isLoading || isOwnContent}
        className={cn(
          "rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          !isOwnContent && "hover:bg-success/10",
          padding,
          userVote === "up" && "text-success bg-success/10"
        )}
        aria-label="Upvote"
        title={isOwnContent ? "You cannot vote on your own content" : "Upvote"}
      >
        <ChevronUp className={iconSize} />
      </button>
      <span className={cn("font-semibold text-foreground", textSize)}>
        {displayedVotes}
      </span>
      <button
        onClick={() => handleVote("down")}
        disabled={isLoading || isOwnContent}
        className={cn(
          "rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          !isOwnContent && "hover:bg-destructive/10",
          padding,
          userVote === "down" && "text-destructive bg-destructive/10"
        )}
        aria-label="Downvote"
        title={isOwnContent ? "You cannot vote on your own content" : "Downvote"}
      >
        <ChevronDown className={iconSize} />
      </button>
    </div>
  );
};

export default VoteCounter;
