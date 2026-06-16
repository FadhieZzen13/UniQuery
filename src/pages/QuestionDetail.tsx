import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Share2, Bookmark, Trash2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { questionsApi, answersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import VoteCounter from "@/components/VoteCounter";
import TagPill from "@/components/TagPill";
import AnswerCard from "@/components/AnswerCard";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import AskQuestionModal from "@/components/AskQuestionModal";
import FlagModal from "@/components/FlagModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Author {
  id?: string;
  name: string;
  avatar?: string;
  reputation?: number;
  joinedAt?: string;
}

interface Question {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: Author;
  votes: number;
  answerCount: number;
  createdAt: string;
  isResolved?: boolean;
  isBookmarked?: boolean;
}

interface Answer {
  id: string;
  content: string;
  author: Author;
  votes: number;
  isVerified: boolean;
  createdAt: string;
}

const QuestionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);

  const fetchQuestionAndAnswers = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [questionData, answersData] = await Promise.all([
        questionsApi.getById(id),
        answersApi.getForQuestion(id),
      ]);
      setQuestion(questionData);
      setIsBookmarked(questionData.isBookmarked ?? false);
      setAnswers(answersData);
    } catch (error) {
      console.error("Error fetching question:", error);
      toast({
        title: "Error",
        description: "Failed to load question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionAndAnswers();
  }, [id]);

  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      toast({
        title: "Empty answer",
        description: "Please write an answer before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!id) return;

    setIsSubmitting(true);
    try {
      const newAnswer = await answersApi.create(id, answerText);
      setAnswers([...answers, newAnswer]);
      setAnswerText("");
      toast({
        title: "Answer posted!",
        description: "Your answer has been submitted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post answer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAnswer = async (answerId: string) => {
    if (!id) return;

    try {
      await answersApi.accept(id, answerId);
      // Refresh answers to show updated verification status
      const answersData = await answersApi.getForQuestion(id!);
      setAnswers(answersData);
      toast({
        title: "Answer verified!",
        description: "This answer has been marked as the accepted answer.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify answer",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuestion = async () => {
    if (!id) return;
    
    setIsDeleting(true);
    try {
      await questionsApi.delete(id);
      toast({
        title: "Question deleted",
        description: "Your question has been permanently deleted.",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete question",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResolveQuestion = async () => {
    if (!id) return;
    
    setIsResolving(true);
    try {
      const result = await questionsApi.resolve(id);
      setQuestion(prev => prev ? { ...prev, isResolved: result.isResolved } : null);
      toast({
        title: result.isResolved ? "Question resolved!" : "Question reopened",
        description: result.isResolved 
          ? "This question has been marked as resolved. No more answers can be submitted."
          : "This question has been reopened for answers.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update question status",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!id || isTogglingBookmark) return;
    
    setIsTogglingBookmark(true);
    try {
      if (isBookmarked) {
        await questionsApi.removeBookmark(id);
        setIsBookmarked(false);
        toast({ title: "Bookmark removed" });
      } else {
        await questionsApi.addBookmark(id);
        setIsBookmarked(true);
        toast({ title: "Question bookmarked" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle bookmark",
        variant: "destructive",
      });
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          isMenuOpen={isSidebarOpen}
          onAskQuestion={() => setIsAskModalOpen(true)}
        />
        <main className="container max-w-4xl mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Question not found</h1>
          <Link to="/dashboard" className="text-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const createdAtDate = new Date(question.createdAt);
  const authorAvatarUrl = question.author.avatar || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${question.author.name || 'Anonymous'}`;
  const userAvatarUrl = user?.avatar || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`;

  const isQuestionAuthor = user && question.author.id != null && question.author.id === user.id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
        onAskQuestion={() => setIsAskModalOpen(true)}
      />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        {/* Back button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to questions
        </Link>

        {/* Question */}
        <article className={`rounded-xl border shadow-sm p-6 animate-fade-in ${
          question.isResolved 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
            : 'bg-card border-border'
        }`}>
          {/* Resolved Badge */}
          {question.isResolved && (
            <div className="flex items-center gap-2 mb-4 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">This question has been resolved</span>
            </div>
          )}
          
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <VoteCounter 
                initialVotes={question.votes} 
                questionId={question.id}
                authorId={question.author.id}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground mb-3">
                {question.title}
              </h1>

              <div className="mb-4">
                <MarkdownRenderer content={question.description} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {question.tags.map((tag) => (
                  <TagPill key={tag} tag={tag} />
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <img
                      src={authorAvatarUrl}
                      alt={question.author.name || "Anonymous"}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <span className="font-medium text-foreground block">
                        {question.author.name || "Anonymous"}
                      </span>
                      <span className="text-xs">
                        Asked on {format(createdAtDate, 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button 
                    className={`p-2 rounded-lg transition-colors ${
                      isBookmarked 
                        ? 'text-primary bg-primary/10 hover:bg-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    onClick={handleToggleBookmark}
                    disabled={isTogglingBookmark}
                    title={isBookmarked ? "Remove bookmark" : "Bookmark question"}
                  >
                    <Bookmark className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
                  </button>
                  <button 
                    onClick={() => setIsFlagModalOpen(true)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Flag question for moderation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                  </button>
                  
                  {/* Author-only actions */}
                  {isQuestionAuthor && (
                    <>
                      <Button
                        variant={question.isResolved ? "outline" : "default"}
                        size="sm"
                        onClick={handleResolveQuestion}
                        disabled={isResolving}
                        className={question.isResolved ? "text-orange-600 border-orange-300 hover:bg-orange-50" : "bg-green-600 hover:bg-green-700"}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {isResolving ? "Updating..." : question.isResolved ? "Reopen" : "Mark Resolved"}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isDeleting}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Question</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this question? This action cannot be undone and will also delete all answers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteQuestion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Answers Section */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {answers.length} Answer{answers.length !== 1 ? "s" : ""}
            </h2>
          </div>

          <div className="space-y-4">
            {answers.map((answer) => (
              <AnswerCard 
                key={answer.id} 
                answer={answer}
                isQuestionAuthor={isQuestionAuthor}
                onVerify={() => handleVerifyAnswer(answer.id)}
              />
            ))}
          </div>

          {answers.length === 0 && (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-muted-foreground">No answers yet. Be the first to help!</p>
            </div>
          )}
        </section>

        {/* Post Answer */}
        {question.isResolved ? (
          <section className="mt-8 bg-muted/50 rounded-xl border border-border p-6 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p>This question has been resolved. New answers are not accepted.</p>
            </div>
          </section>
        ) : (
          <section className="mt-8 bg-card rounded-xl border border-border shadow-sm p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-foreground mb-4">Your Answer</h3>
            
            <div className="flex items-start gap-3 mb-4">
              <img
                src={userAvatarUrl}
                alt={user?.name || "User"}
                className="w-10 h-10 rounded-full"
              />
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write your answer here... Be helpful and provide details."
                rows={5}
                className="flex-1 resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSubmitAnswer} disabled={isSubmitting}>
                {isSubmitting ? "Posting..." : "Post Your Answer"}
              </Button>
            </div>
          </section>
        )}
      </main>

      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
      />

      <FlagModal
        isOpen={isFlagModalOpen}
        onClose={() => setIsFlagModalOpen(false)}
        targetType="QUESTION"
        targetId={question.id}
      />
    </div>
  );
};

export default QuestionDetail;
