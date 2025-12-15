import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Share2, Bookmark } from "lucide-react";
import { questions, answersForQuestion1, currentUser } from "@/data/mockData";
import { formatDistanceToNow } from "date-fns";
import Navbar from "@/components/Navbar";
import VoteCounter from "@/components/VoteCounter";
import TagPill from "@/components/TagPill";
import AnswerCard from "@/components/AnswerCard";
import AskQuestionModal from "@/components/AskQuestionModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const QuestionDetail = () => {
  const { id } = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");

  const question = questions.find((q) => q.id === id);
  const answers = id === "1" ? answersForQuestion1 : [];

  const handleSubmitAnswer = () => {
    if (!answerText.trim()) {
      toast({
        title: "Empty answer",
        description: "Please write an answer before submitting.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Answer posted!",
      description: "Your answer has been submitted successfully.",
    });
    setAnswerText("");
  };

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
        <article className="bg-card rounded-xl border border-border shadow-sm p-6 animate-fade-in">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <VoteCounter initialVotes={question.votes} />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground mb-3">
                {question.title}
              </h1>

              <p className="text-foreground leading-relaxed mb-4">
                {question.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {question.tags.map((tag) => (
                  <TagPill key={tag} tag={tag} />
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <img
                      src={question.author.avatar}
                      alt={question.author.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <span className="font-medium text-foreground block">
                        {question.author.name}
                      </span>
                      <span className="text-xs">
                        Asked {formatDistanceToNow(question.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                    <Bookmark className="h-4 w-4" />
                  </button>
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
              <AnswerCard key={answer.id} answer={answer} />
            ))}
          </div>

          {answers.length === 0 && (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-muted-foreground">No answers yet. Be the first to help!</p>
            </div>
          )}
        </section>

        {/* Post Answer */}
        <section className="mt-8 bg-card rounded-xl border border-border shadow-sm p-6 animate-fade-in">
          <h3 className="text-lg font-semibold text-foreground mb-4">Your Answer</h3>
          
          <div className="flex items-start gap-3 mb-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
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
            <Button onClick={handleSubmitAnswer}>
              Post Your Answer
            </Button>
          </div>
        </section>
      </main>

      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
      />
    </div>
  );
};

export default QuestionDetail;
