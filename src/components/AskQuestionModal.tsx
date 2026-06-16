import { useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
        title: "Question posted!",
        description: "Your question has been submitted successfully.",
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
      <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-card rounded-xl shadow-xl border border-border animate-fade-in">
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

          <div
            className={`rounded-lg border p-4 transition-all ${
              isAnonymous
                ? 'border-l-4 border-l-teal-500 border-teal-200 bg-teal-50/60'
                : 'border-border bg-muted/40'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="anon-toggle" className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck className={isAnonymous ? 'text-teal-600' : 'text-muted-foreground'} size={18} />
                  Post anonymously
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isAnonymous
                    ? 'Your identity is encrypted and protected. Only authorised faculty may request your identity for moderation purposes.'
                    : 'You will post as yourself. Toggle on to hide your identity from peers.'}
                </p>
              </div>
              <Switch
                id="anon-toggle"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                aria-label="Toggle anonymous posting"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Posting..." : "Post Question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AskQuestionModal;
