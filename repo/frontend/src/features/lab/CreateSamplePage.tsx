import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft } from 'lucide-react';

const schema = z.object({
  sampleType: z.string().min(1, 'Sample type is required').max(100),
  collectionDate: z.string().min(1, 'Collection date is required'),
  patientIdentifier: z.string().max(200).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function CreateSamplePage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post('/lab/samples', {
        ...data,
        collectionDate: new Date(data.collectionDate).toISOString(),
      }),
    onSuccess: (res) => navigate(`/lab/${res.data.data.id}`),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError('root', { message: typeof msg === 'string' ? msg : 'Failed to create sample.' });
    },
  });

  return (
    <div className="p-6 max-w-lg">
      <button
        onClick={() => navigate('/lab')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Lab
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">New Lab Sample</h1>

      <div className="bg-card border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">Sample Type *</Label>
            <Input
              {...register('sampleType')}
              placeholder="e.g. Blood, Urine, Tissue"
              className="h-9 text-sm"
            />
            {errors.sampleType && (
              <p className="text-xs text-destructive mt-1">{errors.sampleType.message}</p>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Collection Date *</Label>
            <Input
              type="date"
              {...register('collectionDate')}
              className="h-9 text-sm"
            />
            {errors.collectionDate && (
              <p className="text-xs text-destructive mt-1">{errors.collectionDate.message}</p>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Patient Identifier</Label>
            <Input
              {...register('patientIdentifier')}
              placeholder="Masked ID (only last 4 chars shown in reports)"
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              For privacy, only the last 4 characters will be displayed.
            </p>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Notes</Label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Clinical notes or special handling instructions..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {errors.root && (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/lab')}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending ? 'Submitting…' : 'Submit Sample'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
