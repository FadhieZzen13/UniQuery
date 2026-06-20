import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { moderationApi } from "@/lib/api";

interface FlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "QUESTION" | "ANSWER";
  targetId: string;
}

const FlagModal = ({ isOpen, onClose, targetType, targetId }: FlagModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFlag = async () => {
    setIsSubmitting(true);
    try {
      await moderationApi.createFlag(targetType, targetId);
      toast({
        title: "Content flagged",
        description: "Thank you for reporting this. Our moderators will review it shortly.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to flag content",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Are you sure you want to flag this {targetType.toLowerCase()} for moderation? 
            This action will alert the faculty to review the content for any community guidelines violations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleFlag} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Flag Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FlagModal;
