import { cn } from "@/lib/utils";

interface TagPillProps {
  tag: string;
  onClick?: () => void;
  className?: string;
}

const TagPill = ({ tag, onClick, className }: TagPillProps) => {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium",
        "bg-accent text-accent-foreground",
        "border border-border/50",
        "transition-colors hover:bg-accent/80",
        onClick && "cursor-pointer",
        className
      )}
    >
      #{tag}
    </span>
  );
};

export default TagPill;
