"use client";

import Container from "@/components/layout/Container";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function AdminSettingsPage() {
  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Konfigurasi sistem platform.</p>
      </div>

      <div className="space-y-4">
        {/* API Configuration */}
        <Card>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Konfigurasi koneksi ke backend services.</CardDescription>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <div>
                <p className="text-sm text-text-primary">Backend URL</p>
                <p className="text-xs text-text-muted mt-0.5">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}</p>
              </div>
              <Badge variant="success" dot>Connected</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <div>
                <p className="text-sm text-text-primary">Moodle Integration</p>
                <p className="text-xs text-text-muted mt-0.5">Webservice REST API</p>
              </div>
              <Badge variant="success" dot>Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-text-primary">AI Service (Groq)</p>
                <p className="text-xs text-text-muted mt-0.5">Llama 3.3 70B Versatile</p>
              </div>
              <Badge variant="success" dot>Active</Badge>
            </div>
          </div>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardTitle>Rate Limiting</CardTitle>
          <CardDescription>Pengaturan throttling untuk API endpoints.</CardDescription>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <p className="text-sm text-text-primary">General API</p>
              <span className="text-sm text-text-secondary">100 req / 15 min</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <p className="text-sm text-text-primary">Chat API (Kak Fikra)</p>
              <span className="text-sm text-text-secondary">20 req / 1 min</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-text-primary">Request Body Limit</p>
              <span className="text-sm text-text-secondary">10 KB</span>
            </div>
          </div>
        </Card>

        {/* Mapping Info */}
        <Card>
          <CardTitle>Quiz Mapping</CardTitle>
          <CardDescription>Versi mapping subtes saat ini.</CardDescription>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <p className="text-sm text-text-primary">Mapping Version</p>
              <span className="text-sm text-text-secondary">2.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border-light">
              <p className="text-sm text-text-primary">Last Validated</p>
              <span className="text-sm text-text-secondary">26 Mei 2026</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-text-primary">Score Formula</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded text-text-secondary">
                Math.round((benar / total) * 1000)
              </code>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}