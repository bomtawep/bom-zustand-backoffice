"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeactivateUserMutation, useUsersQuery } from "@/queries/users";
import { useSessionStore } from "@/stores/session-store";

const PAGE_SIZE = 10;

function UsersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skip = Number(searchParams.get("skip") ?? "0");

  const usersQuery = useUsersQuery({ limit: PAGE_SIZE, skip });
  const deactivateMutation = useDeactivateUserMutation();
  const canCreate = useSessionStore((state) => state.hasPermission("user:create"));
  const canUpdate = useSessionStore((state) => state.hasPermission("user:update"));
  const canDelete = useSessionStore((state) => state.hasPermission("user:delete"));

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("skip", String(Math.max(0, nextSkip)));
    router.push(`/dashboard/users?${params.toString()}`);
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateMutation.mutateAsync(id);
      toast.success("User deactivated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate user");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {canCreate && (
          <Button render={<Link href="/dashboard/users/new">New user</Link>} />
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usersQuery.data?.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>
                <Badge variant={user.active ? "default" : "secondary"}>
                  {user.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/dashboard/users/${user.id}`}>Edit</Link>}
                  />
                )}
                {canDelete && user.active && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          Deactivate
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate {user.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This disables their account. They will no longer be able to sign in.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeactivate(user.id)}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={skip === 0}
          onClick={() => goToPage(skip - PAGE_SIZE)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(usersQuery.data?.length ?? 0) < PAGE_SIZE}
          onClick={() => goToPage(skip + PAGE_SIZE)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function UsersListPage() {
  return (
    <Suspense>
      <UsersList />
    </Suspense>
  );
}
