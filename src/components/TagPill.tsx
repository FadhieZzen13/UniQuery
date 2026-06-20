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
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
        "bg-blue-50 text-blue-700 border border-blue-100",
        "transition-colors",
        onClick && "cursor-pointer hover:bg-blue-100",
        className
      )}
    >
      #{tag}
    </span>
  );
};

export default TagPill;
