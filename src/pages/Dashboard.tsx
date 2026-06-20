import { useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { questionsApi } from "@/lib/api";
import { Category } from "@/types";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import QuestionCard from "@/components/QuestionCard";
import AskQuestionModal from "@/components/AskQuestionModal";
import { toast } from "@/hooks/use-toast";

interface Question {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatar: string;
    reputation: number;
  };
  votes: number;
  answerCount: number;
  createdAt: string;
  hasVerifiedAnswer?: boolean;
}


const QUESTIONS_PER_PAGE = 10;

const Dashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const { ref, inView } = useInView();

  const fetchQuestions = useCallback(async (isNextPage = false) => {
    if (isNextPage) {
      setIsFetchingNextPage(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const response = await questionsApi.getAll({
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        sort: sortBy,
        search: search.trim() || undefined,
        limit: QUESTIONS_PER_PAGE,
        offset: (page - 1) * QUESTIONS_PER_PAGE,
      });
      
      if (isNextPage) {
        setQuestions((prev) => [...prev, ...response.questions]);
      } else {
        setQuestions(response.questions);
      }
      setTotal(response.total);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [selectedCategory, sortBy, search, page]);

  useEffect(() => {
    fetchQuestions(page > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuestions]);

  useEffect(() => {
    if (inView && !isLoading && !isFetchingNextPage && questions.length < total) {
      setPage((prev) => prev + 1);
    }
  }, [inView, isLoading, isFetchingNextPage, questions.length, total]);

  const handleQuestionCreated = () => {
    setPage(1);
    fetchQuestions();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
        onAskQuestion={() => setIsAskModalOpen(true)}
      />

      <div className="flex">
        <Sidebar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 lg:p-6 lg:ml-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {selectedCategory === "all" ? "All Questions" : 
                    selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1).replace("-", " ")}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {total} question{total !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="text-sm border border-border rounded-md px-3 py-1.5 bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
                  placeholder="Search..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ minWidth: 160 }}
                />
                <select
                  className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                >
                  <option value="newest">Newest</option>
                  <option value="votes">Most Votes</option>
                  <option value="unanswered">Unanswered</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-md border border-border p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
                {/* Infinite Scroll Observer */}
                {questions.length < total && (
                  <div ref={ref} className="py-4 flex justify-center">
                    {isFetchingNextPage && (
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    )}

                  </div>
                )}

                {questions.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No questions found in this category.</p>
                    <button
                      onClick={() => setIsAskModalOpen(true)}
                      className="text-primary hover:underline mt-2"
                    >
                      Be the first to ask!
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        onQuestionCreated={handleQuestionCreated}
      />
    </div>
  );
};

export default Dashboard;
