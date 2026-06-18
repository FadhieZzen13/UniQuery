import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Highlighter from "react-highlight-words";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { questionsApi } from "@/lib/api";
import Navbar from "@/components/Navbar";
import TagPill from "@/components/TagPill";
import VoteCounter from "@/components/VoteCounter";
import { format } from "date-fns";
import AskQuestionModal from "@/components/AskQuestionModal";
import { toast } from "@/hooks/use-toast";

function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounceValue(query, 250);
  
  const [results, setResults] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await questionsApi.getAll({
        search: searchQuery.trim(),
        limit: 50,
      });
      setResults(response.questions);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: "Failed to fetch search results.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(debouncedQuery);
    if (debouncedQuery.trim()) {
      setSearchParams({ q: debouncedQuery });
    } else {
      setSearchParams({});
    }
  }, [debouncedQuery, fetchResults, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
        onAskQuestion={() => setIsAskModalOpen(true)}
      />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-4 border border-border rounded-xl bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg shadow-sm"
            placeholder="Search questions by title or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {hasSearched && results.length > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                Found {results.length} result{results.length !== 1 ? 's' : ''} for "{debouncedQuery}"
              </p>
            )}

            {hasSearched && results.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SearchIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  We couldn't find any questions matching "{debouncedQuery}". Try adjusting your search terms or ask a new question.
                </p>
                <button
                  onClick={() => setIsAskModalOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Ask Question
                </button>
              </div>
            )}

            {!hasSearched && (
              <div className="text-center py-12 text-muted-foreground">
                Enter a search term above to find questions.
              </div>
            )}

            {results.map((question) => {
              const createdAtDate = new Date(question.createdAt);
              const searchWords = debouncedQuery.split(' ').filter(w => w.length > 0);

              return (
                <Link to={`/question/${question.id}`} key={question.id} className="block">
                  <article className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <VoteCounter initialVotes={question.votes} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-foreground mb-1">
                          <Highlighter
                            highlightClassName="bg-yellow-200 dark:bg-yellow-800 text-foreground"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={question.title}
                          />
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                          <Highlighter
                            highlightClassName="bg-yellow-200 dark:bg-yellow-800 text-foreground"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={question.description || ""}
                          />
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {question.tags.map((tag) => (
                            <TagPill key={tag} tag={tag} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>By {question.author?.name || 'Anonymous'}</span>
                          <span>{format(createdAtDate, 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
      />
    </div>
  );
};

export default Search;
