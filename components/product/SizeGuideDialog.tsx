"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { NUMERIC_SIZE_NOTE, SIZE_GUIDE_ROWS } from "@/lib/size-guide";

interface SizeGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SizeGuideDialog({ open, onOpenChange }: SizeGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none border-none p-8">
        <DialogTitle className="font-heading text-xl">Size Guide</DialogTitle>
        <p className="mt-1 text-sm text-luxe-gray-dark">Measurements in centimetres, taken flat.</p>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
              <th className="py-2">Size</th>
              <th className="py-2">Chest</th>
              <th className="py-2">Waist</th>
              <th className="py-2">Hips</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE_ROWS.map((row) => (
              <tr key={row.size} className="border-b border-border">
                <td className="py-2 font-medium">{row.size}</td>
                <td className="py-2">{row.chestCm} cm</td>
                <td className="py-2">{row.waistCm} cm</td>
                <td className="py-2">{row.hipsCm} cm</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-luxe-gray-dark">{NUMERIC_SIZE_NOTE}</p>
      </DialogContent>
    </Dialog>
  );
}
