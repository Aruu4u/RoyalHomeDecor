import { useCallback, useState } from "react";

import AccountNav from "../../components/account/AccountNav";
import AddressForm from "../../components/account/AddressForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { PageLoader } from "../../components/ui/Feedback";
import { useAsync } from "../../hooks/useAsync";
import { friendlyMessage } from "../../lib/errors";
import { addressService } from "../../services/addresses";
import type {
  Address,
  AddressCreateRequest,
  AddressUpdateRequest,
} from "../../types/address";

import "./account.css";

function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  /* Address awaiting delete confirmation. Null when no dialog is open. */
  const [pendingDeletion, setPendingDeletion] = useState<Address | null>(null);

  const { isLoading, error, reload } = useAsync(
    useCallback(async (signal: AbortSignal) => {
      const list = await addressService.listAddresses(signal);
      setAddresses(list);
      return list;
    }, []),
    [],
    "Unable to load your addresses.",
  );

  const handleCreate = useCallback(async (data: AddressCreateRequest) => {
    const created = await addressService.createAddress(data);

    setAddresses((current) => {
      const next = [...(current ?? []), created];

      /* Only one address can be default, so mirror that locally. */
      return created.is_default
        ? next.map((entry) =>
            entry.id === created.id
              ? entry
              : { ...entry, is_default: false },
          )
        : next;
    });

    setIsCreating(false);
    setMessage({ text: "Address saved.", isError: false });
  }, []);

  const handleUpdate = useCallback(
    async (addressId: string, data: AddressUpdateRequest) => {
      const updated = await addressService.updateAddress(addressId, data);

      setAddresses((current) =>
        (current ?? []).map((entry) => {
          if (entry.id === updated.id) {
            return updated;
          }

          return updated.is_default
            ? { ...entry, is_default: false }
            : entry;
        }),
      );

      setEditingId(null);
      setMessage({ text: "Address updated.", isError: false });
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDeletion) {
      return;
    }

    setBusyId(pendingDeletion.id);
    setMessage(null);

    try {
      await addressService.deleteAddress(pendingDeletion.id);

      setAddresses((current) =>
        (current ?? []).filter((entry) => entry.id !== pendingDeletion.id),
      );

      setMessage({ text: "Address removed.", isError: false });
    } catch (deleteError) {
      setMessage({
        text: friendlyMessage(
          deleteError,
          "We could not remove that address just now.",
        ),
        isError: true,
      });
    } finally {
      setBusyId(null);
      setPendingDeletion(null);
    }
  }, [pendingDeletion]);

  if (isLoading && !addresses) {
    return <PageLoader label="Loading your addresses" />;
  }

  const list = addresses ?? [];

  return (
    <div className="shell account-page page-enter">
      <header className="account-header">
        <p className="eyebrow">Your account</p>
        <h1 className="account-title">Delivery addresses</h1>

        <p className="lede account-subtitle">
          Saved addresses appear at checkout so you can order in a couple of
          taps.
        </p>
      </header>

      <div className="account-layout">
        <AccountNav />

        <div className="account-content">
          <section className="panel">
            <header className="account-panel-head">
              <div>
                <h2 className="account-panel-title">
                  {list.length} saved address{list.length === 1 ? "" : "es"}
                </h2>

                <p className="account-panel-subtitle">
                  Mark one as default to have it preselected at checkout.
                </p>
              </div>

              {!isCreating && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setIsCreating(true);
                    setEditingId(null);
                  }}
                  type="button"
                >
                  Add address
                </button>
              )}
            </header>

            {error && (
              <p className="notice notice-error" role="alert">
                {error}

                <button className="btn-quiet" onClick={reload} type="button">
                  Retry
                </button>
              </p>
            )}

            {message && (
              <p
                className={`notice ${
                  message.isError ? "notice-error" : "notice-success"
                }`}
                role="status"
              >
                {message.text}
              </p>
            )}

            {isCreating && (
              <AddressForm
                onCancel={() => setIsCreating(false)}
                onSubmit={handleCreate}
                submitLabel="Save address"
              />
            )}

            {!isCreating && list.length === 0 && (
              <p className="muted-text">
                You have not saved an address yet. Add one to speed up
                checkout.
              </p>
            )}

            {list.length > 0 && (
              <div className="address-grid">
                {list.map((address) =>
                  editingId === address.id ? (
                    <div className="address-card" key={address.id}>
                      <AddressForm
                        address={address}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(data) => handleUpdate(address.id, data)}
                        submitLabel="Save changes"
                      />
                    </div>
                  ) : (
                    <article className="address-card" key={address.id}>
                      <div className="address-card-head">
                        <span className="address-card-label">
                          {address.label}
                        </span>

                        {address.is_default && (
                          <span className="badge badge-gold">Default</span>
                        )}
                      </div>

                      <p className="address-card-name">
                        {address.recipient_name}
                      </p>

                      <p className="address-card-lines">
                        {address.address_line_1}
                        {address.address_line_2
                          ? `, ${address.address_line_2}`
                          : ""}
                        {address.landmark ? `, ${address.landmark}` : ""}
                        <br />
                        {address.city}, {address.state} {address.postal_code}
                        <br />
                        {address.country}
                      </p>

                      <p className="address-card-phone">{address.phone}</p>

                      <div className="address-card-actions">
                        <button
                          className="btn-quiet"
                          onClick={() => {
                            setEditingId(address.id);
                            setIsCreating(false);
                          }}
                          type="button"
                        >
                          Edit
                        </button>

                        {!address.is_default && (
                          <button
                            className="btn-quiet"
                            disabled={busyId === address.id}
                            onClick={() =>
                              void handleUpdate(address.id, {
                                is_default: true,
                              })
                            }
                            type="button"
                          >
                            Make default
                          </button>
                        )}

                        <button
                          className="btn-danger-quiet"
                          disabled={busyId === address.id}
                          onClick={() => setPendingDeletion(address)}
                          type="button"
                        >
                          {busyId === address.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        cancelLabel="Keep it"
        confirmLabel="Remove address"
        isBusy={busyId === pendingDeletion?.id}
        isOpen={pendingDeletion !== null}
        message="This delivery address will be deleted from your account. Orders you have already placed are not affected."
        onCancel={() => setPendingDeletion(null)}
        onConfirm={() => void handleDelete()}
        subject={
          pendingDeletion
            ? `${pendingDeletion.label} — ${pendingDeletion.recipient_name}, ${pendingDeletion.city}`
            : null
        }
        title="Remove this address?"
      />
    </div>
  );
}

export default AddressesPage;
