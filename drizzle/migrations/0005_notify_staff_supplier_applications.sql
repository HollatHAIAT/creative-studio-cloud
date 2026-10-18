CREATE OR REPLACE FUNCTION public.notify_staff_supplier_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff uuid; resub boolean := TG_OP = 'UPDATE';
BEGIN
  IF NEW.status <> 'pending' OR (TG_OP = 'UPDATE' AND OLD.status = 'pending') THEN RETURN NEW; END IF;
  FOR staff IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','moderator') AND user_id <> NEW.user_id LOOP
    PERFORM public.push_notification(staff, 'supplier_review',
      CASE WHEN resub THEN 'Supplier resubmitted for approval' ELSE 'New supplier application' END,
      CASE WHEN resub THEN 'أعاد مورّد إرسال طلبه للموافقة' ELSE 'طلب مورّد جديد' END,
      NEW.name || CASE WHEN NEW.city <> '' THEN ' — ' || NEW.city ELSE '' END,
      coalesce(nullif(NEW.name_ar,''), NEW.name) || CASE WHEN coalesce(NEW.city_ar,'') <> '' THEN ' — ' || NEW.city_ar ELSE '' END,
      '/admin/suppliers#supplier-' || NEW.user_id);
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_staff_supplier_application() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER supplier_application_notify_staff AFTER INSERT OR UPDATE OF status ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_supplier_application();