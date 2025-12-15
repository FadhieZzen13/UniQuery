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
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 bg-sidebar border-r border-sidebar-border p-4 transition-transform duration-300",
          "lg:sticky lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="space-y-1">
          <h2 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Categories
          </h2>
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
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <IconComponent className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-4 rounded-lg bg-accent/50 border border-border">
            <h3 className="font-semibold text-sm text-foreground mb-1">
              Need help?
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Check our community guidelines before posting.
            </p>
            <a href="#" className="text-xs font-medium text-primary hover:underline">
              View Guidelines →
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
