import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
        Sottra
      </h1>
      <p className="mt-4 text-base text-muted-foreground sm:text-lg">
        Ciò che sta sotto, ora lo sai tu.
      </p>
      <Button className="mt-10" size="lg">
        Scopri
      </Button>
    </div>
  );
};

export default Index;
