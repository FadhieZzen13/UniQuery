import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Menu, X, GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
  onAskQuestion: () => void;
}

const Navbar = ({ onMenuClick, isMenuOpen, onAskQuestion }: NavbarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center gap-4 px-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="hidden sm:inline text-lg">UniQuery</span>
        </Link>

        {/* Search bar */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-muted focus:bg-card"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onAskQuestion}
            size="sm"
            className="hidden sm:flex gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ask Question
          </Button>
          <Button
            onClick={onAskQuestion}
            size="icon"
            className="sm:hidden"
            aria-label="Ask Question"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* User avatar with dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 focus:outline-none">
                <div className="hidden sm:flex flex-col items-end text-xs">
                  <span className="font-medium text-foreground">{displayName.split(' ')[0]}</span>
                  <span className="text-success font-semibold">{user?.reputation || 0} pts</span>
                </div>
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-9 h-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {user?.major && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {user.major} • {user.year}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
