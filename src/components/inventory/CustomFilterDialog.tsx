import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'less_equal'
  | 'greater_than'
  | 'greater_equal'
  | 'contains'
  | 'not_contains'
  | 'begins_with'
  | 'ends_with'
  | 'is_blank'
  | 'is_not_blank';

export interface FilterCondition {
  operator: FilterOperator;
  value: string;
}

export interface CustomFilterState {
  condition1: FilterCondition;
  condition2: FilterCondition;
  logic: 'and' | 'or';
}

const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'begins_with', label: 'begins with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_blank', label: 'is blank' },
  { value: 'is_not_blank', label: 'is not blank' },
];

const NUMBER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_equal', label: 'is less than or equal to' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'greater_equal', label: 'is greater than or equal to' },
  { value: 'is_blank', label: 'is blank' },
  { value: 'is_not_blank', label: 'is not blank' },
];

interface CustomFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnLabel: string;
  columnType?: string;
  onApply: (filter: CustomFilterState) => void;
  initialFilter?: CustomFilterState;
}

const emptyCondition: FilterCondition = { operator: 'equals', value: '' };

export function CustomFilterDialog({
  open,
  onOpenChange,
  columnLabel,
  columnType,
  onApply,
  initialFilter,
}: CustomFilterDialogProps) {
  const [condition1, setCondition1] = useState<FilterCondition>(
    initialFilter?.condition1 ?? { ...emptyCondition }
  );
  const [condition2, setCondition2] = useState<FilterCondition>(
    initialFilter?.condition2 ?? { ...emptyCondition }
  );
  const [logic, setLogic] = useState<'and' | 'or'>(initialFilter?.logic ?? 'and');

  const operators = columnType === 'number' ? NUMBER_OPERATORS : TEXT_OPERATORS;
  const noValueOps: FilterOperator[] = ['is_blank', 'is_not_blank'];

  const handleApply = () => {
    onApply({ condition1, condition2, logic });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Custom Filter</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Show rows where: <strong>{columnLabel}</strong>
          </p>

          {/* Condition 1 */}
          <div className="flex items-center gap-2">
            <Select
              value={condition1.operator}
              onValueChange={(v) =>
                setCondition1((prev) => ({ ...prev, operator: v as FilterOperator }))
              }
            >
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={condition1.value}
              onChange={(e) =>
                setCondition1((prev) => ({ ...prev, value: e.target.value }))
              }
              disabled={noValueOps.includes(condition1.operator)}
              className="h-9 text-xs flex-1"
              placeholder=""
            />
          </div>

          {/* AND / OR */}
          <RadioGroup
            value={logic}
            onValueChange={(v) => setLogic(v as 'and' | 'or')}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="and" id="logic-and" />
              <Label htmlFor="logic-and" className="text-xs font-medium">AND</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="or" id="logic-or" />
              <Label htmlFor="logic-or" className="text-xs font-medium">OR</Label>
            </div>
          </RadioGroup>

          {/* Condition 2 */}
          <div className="flex items-center gap-2">
            <Select
              value={condition2.operator}
              onValueChange={(v) =>
                setCondition2((prev) => ({ ...prev, operator: v as FilterOperator }))
              }
            >
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={condition2.value}
              onChange={(e) =>
                setCondition2((prev) => ({ ...prev, value: e.target.value }))
              }
              disabled={noValueOps.includes(condition2.operator)}
              className="h-9 text-xs flex-1"
              placeholder=""
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
