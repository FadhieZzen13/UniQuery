import { LayoutGrid, GraduationCap, FileText, Building, Users } from "lucide-react";
import { categories } from "@/data/mockData";
import { Category } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
  isOpen: boolean;
  onClose: () => void;
}

const iconMap = {
  LayoutGrid,
  GraduationCap,
  FileText,
  Building,
  Users,
};

const Sidebar = ({ selectedCategory, onCategoryChange, isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-52 bg-white border-r border-border py-4 transition-transform duration-200",
          "lg:sticky lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="px-2">
          <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Categories
          </p>
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon as keyof typeof iconMap];
            const isActive = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => {
                  onCategoryChange(category.id);
                  onClose();
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors text-left",
                  isActive
                    ? "bg-accent text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <IconComponent
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {category.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
