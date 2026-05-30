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

const VoteCounter = ({ initialVotes, size = "md", questionId, answerId, authorId }: VoteCounterProps) => {
  const { user, isAuthenticated } = useAuth();
  const [votes, setVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if the current user is the author of this content
  const isOwnContent = user && authorId && user.id === authorId;

  // Fetch user's existing vote and vote count
  const fetchVoteStatusAndCount = async () => {
    if (!isAuthenticated) return;
    try {
      if (questionId) {
        const status = await votesApi.getQuestionVoteStatus(questionId);
        if (status.value === 1) setUserVote("up");
        else if (status.value === -1) setUserVote("down");
        else setUserVote(null);
        // Fetch latest vote count from question API
        const q = await import("@/lib/api").then(m => m.questionsApi.getById(questionId));
        setVotes(q.votes);
      } else if (answerId) {
        const status = await votesApi.getAnswerVoteStatus(answerId);
        if (status.value === 1) setUserVote("up");
        else if (status.value === -1) setUserVote("down");
        else setUserVote(null);
        // No direct answer vote count API, so just update local state
      }
    } catch (error) {
      // Silently fail
      console.error("Failed to fetch vote status/count:", error);
    }
  };

  useEffect(() => {
    fetchVoteStatusAndCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, answerId, isAuthenticated]);

  const handleVote = async (direction: "up" | "down") => {
    if (isLoading) return;
    
    // Prevent voting on own content
    if (isOwnContent) {
      toast({
        title: "Cannot vote",
        description: "You cannot vote on your own content",
        variant: "destructive",
      });
      return;
    }
    
    // If no questionId or answerId, just update locally (for display purposes)
    if (!questionId && !answerId) {
      if (direction === "up") {
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
      } else {
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
      }
      return;
    }

    setIsLoading(true);
    const value = direction === "up" ? 1 : -1;

    try {
      if (questionId) {
        await votesApi.voteQuestion(questionId, value);
      } else if (answerId) {
        await votesApi.voteAnswer(answerId, value);
      }
      // After voting, re-fetch vote status and count
      await fetchVoteStatusAndCount();
    } catch (error) {
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
        {votes}
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
