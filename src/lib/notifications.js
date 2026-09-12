import { supabase } from './supabase'

const INSURANCE_SOON_DAYS = 30
const INVOICE_STALE_DAYS = 45

function getEndDate(project) {
  if (!project.start_date || !project.duration_months) return null
  const d = new Date(project.start_date)
  d.setMonth(d.getMonth() + project.duration_months + Math.round((project.delay_weeks || 0) * 7 / 30))
  return d
}

function diffDays(date) {
  return Math.round((date - new Date()) / (1000 * 60 * 60 * 24))
}

// Alertes calculées côté client à partir des données existantes (délais,
// décennales/assurances proches de l'échéance, factures en attente depuis
// longtemps). Pas d'infrastructure email/push : cette v1 est un centre de
// notifications in-app.
export async function fetchAlerts() {
  const [{ data: projects }, { data: companies }, { data: invoices }] = await Promise.all([
    supabase.from('projects').select('id, name, status, start_date, duration_months, delay_weeks'),
    supabase.from('companies').select('id, name, insurances(*)'),
    supabase.from('invoices').select('id, invoice_number, invoice_date, status, project_id').neq('status', 'payee'),
  ])

  const alerts = []
  const projectsById = new Map((projects || []).map(p => [p.id, p]))

  for (const p of projects || []) {
    if (p.status !== 'en_cours') continue
    const end = getEndDate(p)
    if (end && end < new Date()) {
      alerts.push({
        id: 'delay-' + p.id,
        severity: 'high',
        title: p.name,
        message: 'Dépassement de délai',
        link: '/chantier/' + p.id,
      })
    }
  }

  for (const c of companies || []) {
    for (const ins of c.insurances || []) {
      if (!ins.end_date) continue
      const days = diffDays(new Date(ins.end_date))
      const label = ins.type === 'decennale' ? 'Décennale' : 'Assurance'
      if (days < 0) {
        alerts.push({ id: 'ins-' + ins.id, severity: 'high', title: c.name, message: label + ' expirée', link: '/entreprise/' + c.id })
      } else if (days <= INSURANCE_SOON_DAYS) {
        alerts.push({ id: 'ins-' + ins.id, severity: 'medium', title: c.name, message: label + ' expire dans ' + days + ' j', link: '/entreprise/' + c.id })
      }
    }
  }

  for (const inv of invoices || []) {
    if (!inv.invoice_date) continue
    const days = diffDays(new Date(inv.invoice_date)) * -1
    if (days >= INVOICE_STALE_DAYS) {
      const project = projectsById.get(inv.project_id)
      alerts.push({
        id: 'invoice-' + inv.id,
        severity: 'medium',
        title: project?.name || 'Facture',
        message: 'Facture ' + (inv.invoice_number || 'sans numéro') + ' en attente depuis ' + days + ' j',
        link: inv.project_id ? '/chantier/' + inv.project_id : '/',
      })
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
}
