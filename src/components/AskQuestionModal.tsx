import { useState } from "react";
import { X, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category } from "@/types";
import { toast } from "@/hooks/use-toast";
import { questionsApi } from "@/lib/api";

const categories = [
  { id: "academic", label: "Academic" },
  { id: "administrative", label: "Administrative" },
  { id: "hostel", label: "Hostel & Facilities" },
  { id: "student-life", label: "Student Life" },
];

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionCreated?: () => void;
}

const AskQuestionModal = ({ isOpen, onClose, onQuestionCreated }: AskQuestionModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("academic");
  const [tags, setTags] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedDescription) {
      toast({
        title: "Missing information",
        description: "Please fill in the title and description.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedTitle.length < 3 || trimmedDescription.length < 3) {
      toast({
        title: "Too short",
        description: "Title and description must each be at least 3 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse tags from comma-separated string
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await questionsApi.create({
        title: trimmedTitle,
        description: trimmedDescription,
        category,
        tags: tagArray,
        isAnonymous,
      });

      toast({
        title: isAnonymous ? "Question posted anonymously!" : "Question posted!",
        description: isAnonymous
          ? "Your identity is hidden. Only moderators can reveal it if needed."
          : "Your question has been submitted successfully.",
      });

      setTitle("");
      setDescription("");
      setCategory("academic");
      setTags("");
      setIsAnonymous(false);
      onClose();
      onQuestionCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-lg border border-border shadow-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Ask a Question</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question about?"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Be specific and imagine you're asking another student.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide all the details someone would need to answer your question..."
              rows={5}
              className="w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Category
            </label>
            <Select value={category} onValueChange={(val) => setCategory(val as Category)}>
              <SelectTrigger className="w-full bg-card">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. FYP, Bursary, Library (comma separated)"
              className="w-full"
            />
          </div>

          {/* ── Anonymity Toggle ── */}
          <div
            id="anonymity-toggle-section"
            role="group"
            aria-label="Anonymity setting"
            className={`
              relative rounded-lg p-3.5 cursor-pointer select-none
              transition-all duration-200 ease-in-out
              ${isAnonymous
                ? "border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/40 shadow-[0_0_0_1px_rgba(20,184,166,0.15)]"
                : "border-2 border-border bg-muted/30 hover:border-muted-foreground/30"
              }
            `}
            onClick={() => setIsAnonymous((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsAnonymous((prev) => !prev);
              }
            }}
            tabIndex={0}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={`
                  flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
                  transition-colors duration-200
                  ${isAnonymous
                    ? "bg-teal-500 text-white"
                    : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {isAnonymous ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isAnonymous ? "text-teal-700 dark:text-teal-300" : "text-foreground"}`}>
                    Post Anonymously
                  </span>
                  {isAnonymous && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-teal-500/15 text-teal-600 dark:text-teal-400">
                      On
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${isAnonymous ? "text-teal-600/80 dark:text-teal-400/70" : "text-muted-foreground"}`}>
                  {isAnonymous
                    ? "Your identity is protected. Other students won't see who posted this."
                    : "Your name and avatar will be visible to everyone."}
                </p>
              </div>

              {/* Toggle switch */}
              <div
                className={`
                  relative flex-shrink-0 w-11 h-6 rounded-full
                  transition-colors duration-200 ease-in-out
                  ${isAnonymous ? "bg-teal-500" : "bg-muted-foreground/25"}
                `}
                role="switch"
                aria-checked={isAnonymous}
                aria-label="Toggle anonymous posting"
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
                    transition-transform duration-200 ease-in-out
                    ${isAnonymous ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </div>
            </div>

            {/* Expanded reassurance text when enabled */}
            {isAnonymous && (
              <div className="mt-3 pt-3 border-t border-teal-200 dark:border-teal-800/50">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-teal-600/70 dark:text-teal-400/60 leading-relaxed">
                    Your identity is encrypted end-to-end. Only faculty moderators may decrypt it under strict audit logging, and only for safety-critical situations.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Posting..." : isAnonymous ? "Post Anonymously" : "Post Question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionModal;
