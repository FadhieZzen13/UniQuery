import { useState } from "react";
import { questions } from "@/data/mockData";
import { Category } from "@/types";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import QuestionCard from "@/components/QuestionCard";
import AskQuestionModal from "@/components/AskQuestionModal";

const Dashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);

  const filteredQuestions = selectedCategory === "all"
    ? questions
    : questions.filter((q) => q.category === selectedCategory);

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
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {selectedCategory === "all" ? "All Questions" : 
                    selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1).replace("-", " ")}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredQuestions.length} question{filteredQuestions.length !== 1 ? "s" : ""}
                </p>
              </div>

              <select
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue="newest"
              >
                <option value="newest">Newest</option>
                <option value="votes">Most Votes</option>
                <option value="unanswered">Unanswered</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredQuestions.map((question) => (
                <QuestionCard key={question.id} question={question} />
              ))}
            </div>

            {filteredQuestions.length === 0 && (
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
        </main>
      </div>

      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
